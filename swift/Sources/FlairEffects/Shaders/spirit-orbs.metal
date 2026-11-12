// flair-metal-hash: 73b53582
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    packed_float3 uColor;
    float uCount;
    float uSize;
    float uOpacity;
    float uDart;
    float uDim;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_spirit_orbs_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _87)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_87.uBackdrop) * _87.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_87.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _87)
{
    float4 _231;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _231 = overBackdrop(param, _87);
    }
    else
    {
        float2 param_1 = fract(uv);
        _231 = float4(testCard(param_1), 1.0);
    }
    return _231;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _87, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_87.iResolution[0], _87.iResolution[1]);
    float aspect = _87.iResolution[0u] / _87.iResolution[1u];
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _87);
    float3 col = pic.xyz * (1.0 - (0.449999988079071044921875 * _87.uDim));
    float2 p = float2(uv.x * aspect, uv.y);
    float2 span = float2(aspect, 1.0) + float2(0.20000000298023223876953125);
    int n = int(_87.uCount + 0.5);
    float a = 0.0;
    for (int i = 0; i < 24; i++)
    {
        if (i >= n)
        {
            break;
        }
        float fi = float(i);
        float2 param_1 = float2(fi * 3.7000000476837158203125, 1.89999997615814208984375);
        float2 h = hash22(param_1);
        float2 param_2 = float2(fi * 1.2999999523162841796875, 8.1000003814697265625);
        float2 g = hash22(param_2);
        float period = 2.5 + (4.0 * g.x);
        float life = (_87.iTime / period) + (g.y * 5.0);
        float dart = smoothstep(0.89999997615814208984375, 0.9700000286102294921875, fract(life));
        float2 param_3 = float2(fi, 4.400000095367431640625);
        float2 dir = fast::normalize(hash22(param_3) - float2(0.5));
        float2 drift = float2(sin((_87.iTime * 0.20999999344348907470703125) + (fi * 9.0)) + (0.5 * sin((_87.iTime * 0.5299999713897705078125) + fi)), sin((_87.iTime * 0.17000000178813934326171875) + (fi * 4.0)) + (0.5 * sin((_87.iTime * 0.4699999988079071044921875) + (fi * 2.0)))) * 0.0500000007450580596923828125;
        float2 c = mod(((h * span) + drift) + (((dir * (floor(life) + dart)) * 0.300000011920928955078125) * _87.uDart), span) - float2(0.100000001490116119384765625);
        float r = (0.01200000010430812835693359375 + (0.02999999932944774627685546875 * fract(h.x * 13.0))) * _87.uSize;
        float2 d = p - c;
        float speed = ((dart * (1.0 - dart)) * 4.0) * _87.uDart;
        float along = dot(d, dir);
        d = (d - (dir * along)) + ((dir * along) / float2(1.0 + (3.0 * speed)));
        float dist = length(d);
        float edge = smoothstep(r, 0.819999992847442626953125 * r, dist);
        float ring = edge * smoothstep(0.550000011920928955078125 * r, r, dist);
        float flicker = 0.75 + (0.25 * sin((_87.iTime * (1.0 + g.x)) + fi));
        a += ((((0.180000007152557373046875 * edge) + (0.5 * ring)) + ((0.3499999940395355224609375 * exp((-dist) / (0.25 * r))) * edge)) * flicker);
    }
    col = float3(1.0) - ((float3(1.0) - col) * (float3(1.0) - (float3(_87.uColor) * fast::clamp(a * _87.uOpacity, 0.0, 1.0))));
    fragColor = float4(col, pic.w);
}

fragment flair_spirit_orbs_frag_out flair_spirit_orbs_frag(constant FlairUniforms& _87 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_spirit_orbs_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _570;
    if (_87.flair_flipY > 0.5)
    {
        _570 = _87.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _570 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _570);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _87, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

