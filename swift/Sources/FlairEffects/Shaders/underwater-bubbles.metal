// flair-metal-hash: ab24f62c
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    int uCount;
    float uSize;
    float uSpeed;
    char _m16_pad[4];
    packed_float3 uTint;
    float uTintAmount;
    float uCaustics;
    float uWaviness;
    char _m20_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_underwater_bubbles_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _183)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_183.uBackdrop) * _183.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_183.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _183)
{
    float4 _324;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _324 = overBackdrop(param, _183);
    }
    else
    {
        float2 param_1 = fract(uv);
        _324 = float4(testCard(param_1), 1.0);
    }
    return _324;
}

static inline __attribute__((always_inline))
float caustic(thread const float2& uv, thread const float& t)
{
    float2 p = (uv * 6.28318023681640625) - float2(250.0);
    float2 i = p;
    float c = 1.0;
    for (int n = 0; n < 4; n++)
    {
        float tt = t * (1.0 - (3.5 / float(n + 1)));
        i = p + float2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += (1.0 / length(float2(p.x / (sin(i.x + tt) / 0.004999999888241291046142578125), p.y / (cos(i.y + tt) / 0.004999999888241291046142578125))));
    }
    c /= 4.0;
    c = 1.16999995708465576171875 - powr(c, 1.39999997615814208984375);
    return fast::min(powr(abs(c), 8.0), 1.5);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _183, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _183.iResolution[1u];
    float2 uv = fragCoord / float2(_183.iResolution[0], _183.iResolution[1]);
    float2 p = fragCoord * px;
    float aspect = _183.iResolution[0u] / _183.iResolution[1u];
    float2 wave = float2(sin((p.y * 14.0) + (_183.iTime * 1.2999999523162841796875)) + (0.5 * sin((p.x * 23.0) - (_183.iTime * 1.7000000476837158203125))), cos((p.x * 12.0) - (_183.iTime * 1.10000002384185791015625))) * (_183.uWaviness * 0.006000000052154064178466796875);
    float2 lens = float2(0.0);
    float cover = 0.0;
    float rim = 0.0;
    float shine = 0.0;
    for (int i = 0; i < 40; i++)
    {
        if (i >= _183.uCount)
        {
            break;
        }
        float2 param = float2((float(i) * 2.13000011444091796875) + 0.699999988079071044921875, 4.099999904632568359375);
        float2 h = hash22(param);
        float2 param_1 = (h * 37.0) + float2(1.2999999523162841796875);
        float h3 = hash12(param_1);
        float R = _183.uSize * mix(0.01200000010430812835693359375, 0.04500000178813934326171875, h3 * h3);
        float speed = _183.uSpeed * (0.119999997317790985107421875 + (3.0 * R));
        float travel = 1.14999997615814208984375 + (4.0 * R);
        float y = (mod((h.y * travel) + (_183.iTime * speed), travel) - (2.0 * R)) - 0.0500000007450580596923828125;
        float x = (h.x * aspect) + ((0.02999999932944774627685546875 * sin(((_183.iTime * (1.5 + h3)) + (h.y * 30.0)) + (y * 8.0))) * (0.5 + (10.0 * R)));
        float2 d = p - float2(x, y);
        float sq = 1.0 + ((0.119999997317790985107421875 * sin(((_183.iTime * 9.0) * (0.60000002384185791015625 + h3)) + (h.x * 20.0))) * fast::min(1.0, R * 30.0));
        d *= float2(1.0 / sq, sq);
        float r = length(d) / R;
        float edge = px / R;
        if (r > (1.0 + (2.0 * edge)))
        {
            continue;
        }
        float2 n = d / float2(R);
        float rr = fast::min(r, 1.0);
        float z = sqrt(1.0 - (rr * rr));
        cover = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
        lens = ((-n) * R) * 0.699999988079071044921875;
        rim = powr(1.0 - z, 2.5);
        float2 s = n - float2(-0.3499999940395355224609375, 0.4000000059604644775390625);
        shine = exp((-dot(s, s)) / 0.02500000037252902984619140625) + (0.4000000059604644775390625 * exp((-dot(n - float2(0.4000000059604644775390625, -0.449999988079071044921875), n - float2(0.4000000059604644775390625, -0.449999988079071044921875))) / 0.00999999977648258209228515625));
    }
    float2 suv = (uv + wave) + ((lens * float2(1.0 / aspect, 1.0)) * cover);
    float2 param_2 = suv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_2, _183);
    float3 col = pic.xyz;
    float3 water = float3(_183.uTint) * (0.449999988079071044921875 + (0.699999988079071044921875 * uv.y));
    col = mix(col, water + ((col * float3(_183.uTint)) * 0.89999997615814208984375), float3(_183.uTintAmount * (0.64999997615814208984375 + (0.3499999940395355224609375 * (1.0 - uv.y)))));
    float2 param_3 = (p * 0.89999997615814208984375) + (wave * 20.0);
    float param_4 = _183.iTime * 0.5;
    float light = caustic(param_3, param_4);
    col += ((float3(0.800000011920928955078125, 1.0, 0.949999988079071044921875) * ((_183.uCaustics * light) * 0.300000011920928955078125)) * (0.3499999940395355224609375 + (0.64999997615814208984375 * uv.y)));
    float2 param_5 = float2((p.x * 5.0) + (p.y * 1.2000000476837158203125), _183.iTime * 0.25);
    float shafts = vnoise(param_5);
    col += (float3(0.800000011920928955078125, 1.0, 1.0) * ((((_183.uCaustics * 0.100000001490116119384765625) * shafts) * uv.y) * uv.y));
    col = mix(col, (col * 1.10000002384185791015625) + float3(0.039999999105930328369140625), float3(cover * 0.5));
    col += (((float3(0.85000002384185791015625, 1.0, 1.0) * (rim * 0.85000002384185791015625)) + float3(shine * 0.89999997615814208984375)) * cover);
    fragColor = float4(col, fast::max(pic.w, cover));
}

fragment flair_underwater_bubbles_frag_out flair_underwater_bubbles_frag(constant FlairUniforms& _183 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_underwater_bubbles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _871;
    if (_183.flair_flipY > 0.5)
    {
        _871 = _183.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _871 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _871);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _183, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

