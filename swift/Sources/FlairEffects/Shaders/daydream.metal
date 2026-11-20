// flair-metal-hash: 198aed7e
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
    float uGlow;
    float uBreathe;
    float uWisps;
    char _m16_pad[4];
    packed_float3 uTint;
    float uFeather;
    float uShimmer;
    float uFade;
    char _m20_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_daydream_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _140)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_140.uBackdrop) * _140.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_140.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _140)
{
    float4 _282;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _282 = overBackdrop(param, _140);
    }
    else
    {
        float2 param_1 = fract(uv);
        _282 = float4(testCard(param_1), 1.0);
    }
    return _282;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 dreamBlur(thread const float2& fragCoord, thread const float& r, constant FlairUniforms& _140, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
    float lod = fast::max(0.0, log2((r * fast::max(ts.x / _140.iResolution[0u], ts.y / _140.iResolution[1u])) / 4.0));
    float2 param = fragCoord;
    float spin = hash12(param) * 6.28318023681640625;
    float3 sum = float3(0.0);
    float3 _501;
    for (int i = 0; i < 12; i++)
    {
        float fi = float(i);
        float rr = sqrt((fi + 0.5) / 12.0) * r;
        float a = (fi * 2.399960041046142578125) + spin;
        float2 uv = (fragCoord + (float2(cos(a), sin(a)) * rr)) / float2(_140.iResolution[0], _140.iResolution[1]);
        if (int2(uImage.get_width(), uImage.get_height()).x > 1)
        {
            float4 param_1 = uImage.sample(uImageSmplr, uv, level(lod));
            _501 = overBackdrop(param_1, _140).xyz;
        }
        else
        {
            float2 param_2 = fract(uv);
            _501 = testCard(param_2);
        }
        sum += _501;
    }
    return sum / float3(12.0);
}

static inline __attribute__((always_inline))
float dreamLuma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float tiledNoise(thread const float2& p, thread const float& period)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float x0 = mod(i.x, period);
    float x1 = mod(i.x + 1.0, period);
    float2 param = float2(x0, i.y);
    float a = hash12(param);
    float2 param_1 = float2(x1, i.y);
    float b = hash12(param_1);
    float2 param_2 = float2(x0, i.y + 1.0);
    float c = hash12(param_2);
    float2 param_3 = float2(x1, i.y + 1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float tiledFbm(thread float2& p, thread float& period, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        float param_1 = period;
        sum += (amp * tiledNoise(param, param_1));
        p = (p * 2.0) + float2(0.0, 7.309999942779541015625);
        period *= 2.0;
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _140, texture2d<float> uImage, sampler uImageSmplr)
{
    float side = fast::min(_140.iResolution[0u], _140.iResolution[1u]);
    float2 uv = fragCoord / float2(_140.iResolution[0], _140.iResolution[1]);
    float2 q = (fragCoord - (float2(_140.iResolution[0], _140.iResolution[1]) * 0.5)) / float2(side);
    float phase = mod(_140.iTime, 20.0) / 20.0;
    float turn = phase * 6.28318023681640625;
    float2 ripple = float2(sin((q.y * 13.0) + (turn * 3.0)), sin(((q.x * 11.0) - (turn * 2.0)) + 1.7000000476837158203125)) * (_140.uShimmer * 0.006000000052154064178466796875);
    float2 at = fragCoord + (ripple * side);
    float2 param = at / float2(_140.iResolution[0], _140.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _140);
    float breath = 1.0 + ((_140.uBreathe * 0.449999988079071044921875) * sin(turn * 2.0));
    float glow = _140.uGlow * breath;
    float2 param_1 = at;
    float param_2 = 0.0900000035762786865234375 * side;
    float3 blur = dreamBlur(param_1, param_2, _140, uImage, uImageSmplr);
    float3 param_3 = blur;
    float3 bloom = (blur * smoothstep(0.300000011920928955078125, 1.0, dreamLuma(param_3))) * mix(float3(1.0), float3(_140.uTint), float3(0.60000002384185791015625));
    float3 col = pic.xyz + ((float3(1.0) - pic.xyz) * fast::clamp((bloom * glow) * 1.60000002384185791015625, float3(0.0), float3(1.0)));
    col = mix(col, blur, float3(glow * 0.180000007152557373046875));
    col = (col * (1.0 - (0.119999997317790985107421875 * glow))) + (float3(_140.uTint) * (0.119999997317790985107421875 * glow));
    float2 param_4 = float2((q.x * 1.5) + (phase * 3.0), q.y * 1.5) + float2(4.0);
    float param_5 = 3.0;
    int param_6 = 2;
    float _690 = tiledFbm(param_4, param_5, param_6);
    float2 param_7 = float2((q.x * 1.5) - (phase * 3.0), q.y * 1.5) + float2(9.0);
    float param_8 = 3.0;
    int param_9 = 2;
    float _706 = tiledFbm(param_7, param_8, param_9);
    float2 warp = float2(_690, _706) - float2(0.5);
    float2 param_10 = float2((q.x * 1.39999997615814208984375) - (phase * 4.0), q.y * 3.400000095367431640625) + (warp * 1.2000000476837158203125);
    float param_11 = 4.0;
    int param_12 = 4;
    float _730 = tiledFbm(param_10, param_11, param_12);
    float near = _730;
    float2 param_13 = float2((q.x * 2.599999904632568359375) + (phase * 6.0), (q.y * 5.0) + 3.0) + (warp * 0.800000011920928955078125);
    float param_14 = 6.0;
    int param_15 = 3;
    float _754 = tiledFbm(param_13, param_14, param_15);
    float far = _754;
    float wisp = smoothstep(0.4799999892711639404296875, 0.7799999713897705078125, (near * 0.64999997615814208984375) + (far * 0.3499999940395355224609375));
    float mist = _140.uWisps * (0.0599999986588954925537109375 + (0.60000002384185791015625 * wisp));
    float3 haze = float3(_140.uTint) + (fast::max(blur - float3(0.5), float3(0.0)) * 1.39999997615814208984375);
    col = mix(col, haze, float3(mist));
    float3 param_16 = col;
    float3 param_17 = float3(_140.uTint);
    float3 faded = (float3(_140.uTint) * dreamLuma(param_16)) / float3(fast::max(dreamLuma(param_17), 0.0500000007450580596923828125));
    col = mix(col, fast::clamp(faded, float3(0.0), float3(1.0)), float3(_140.uFade * 0.75));
    float2 cell = floor(q * 7.0);
    float2 param_18 = cell + float2(31.0);
    float2 h = hash22(param_18);
    bool _828 = _140.uShimmer > 0.0;
    bool _835;
    if (_828)
    {
        _835 = h.x > 0.86000001430511474609375;
    }
    else
    {
        _835 = _828;
    }
    if (_835)
    {
        float2 param_19 = cell + float2(7.0);
        float2 d = (fract(q * 7.0) - float2(0.25)) - (hash22(param_19) * 0.5);
        float star = (exp((-dot(d, d)) * 140.0) + (0.4000000059604644775390625 * exp(((-abs(d.x)) * 50.0) - ((d.y * d.y) * 900.0)))) + (0.4000000059604644775390625 * exp(((-abs(d.y)) * 50.0) - ((d.x * d.x) * 900.0)));
        float pulse = powr(fast::max(0.0, sin((turn * (1.0 + floor(h.y * 3.0))) + (h.y * 40.0))), 10.0);
        col += (mix(float3(1.0), float3(_140.uTint), float3(0.4000000059604644775390625)) * (((star * pulse) * _140.uShimmer) * 0.89999997615814208984375));
    }
    col = fast::clamp(col, float3(0.0), float3(1.0));
    float edge = 1.0;
    if (_140.uFeather > 0.0)
    {
        float2 halfSize = (float2(_140.iResolution[0], _140.iResolution[1]) * 0.5) / float2(side);
        float2 b = (abs(q) - halfSize) + float2(_140.uFeather);
        float inside = _140.uFeather - (length(fast::max(b, float2(0.0))) + fast::min(fast::max(b.x, b.y), 0.0));
        float2 param_20 = float2((q.x * 3.0) + (phase * 6.0), q.y * 3.0) + (warp * 2.0);
        float param_21 = 6.0;
        int param_22 = 3;
        float _984 = tiledFbm(param_20, param_21, param_22);
        float n = _984;
        edge = smoothstep(0.0199999995529651641845703125, 1.0, (inside / _140.uFeather) * (0.449999988079071044921875 + (1.10000002384185791015625 * n)));
        col = mix(mix(col, haze, float3(0.449999988079071044921875)), col, float3(smoothstep(0.0, 0.699999988079071044921875, edge)));
    }
    float alpha = mix(_140.uBackdropAlpha, pic.w, edge);
    float3 under = (float3(_140.uBackdrop) * _140.uBackdropAlpha) * (1.0 - edge);
    fragColor = float4((((col * pic.w) * edge) + under) / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

fragment flair_daydream_frag_out flair_daydream_frag(constant FlairUniforms& _140 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_daydream_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1050;
    if (_140.flair_flipY > 0.5)
    {
        _1050 = _140.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1050 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1050);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _140, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

