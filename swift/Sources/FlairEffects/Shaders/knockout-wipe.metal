// flair-metal-hash: d2749e5a
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

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    float uAngle;
    char _m14_pad[12];
    packed_float3 uEdge;
    float uEdgeWidth;
    float uGlow;
    uint uChecker;
    float uCheckerSize;
    uint uAnimate;
    float uProgress;
    char _m21_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_knockout_wipe_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _68)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _215 = ts.x <= 1;
    bool _222;
    if (!_215)
    {
        _222 = ts.y <= 1;
    }
    else
    {
        _222 = _215;
    }
    bool _230;
    if (!_222)
    {
        _230 = _68.iResolution[0u] <= 0.0;
    }
    else
    {
        _230 = _222;
    }
    bool _237;
    if (!_230)
    {
        _237 = _68.iResolution[1u] <= 0.0;
    }
    else
    {
        _237 = _230;
    }
    if (_237)
    {
        return uv;
    }
    float boxAspect = _68.iResolution[0u] / _68.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _260;
    if (boxAspect > texAspect)
    {
        _260 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _260 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _260;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _68)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_68.uBackdrop) * _68.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_68.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 knockout(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& fragCoord, constant FlairUniforms& _68)
{
    float4 _320;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float2 param = uv;
        _320 = tex.sample(texSmplr, fitCoverUV(tex, texSmplr, param, _68));
    }
    else
    {
        _320 = float4(0.0);
    }
    float4 s = _320;
    float4 _331 = s;
    float _334 = s.w;
    float3 _336 = fast::min(_331.xyz, float3(_334));
    s.x = _336.x;
    s.y = _336.y;
    s.z = _336.z;
    if (!(_68.uChecker != 0u))
    {
        float4 param_1 = s;
        return overBackdrop(param_1, _68);
    }
    float2 cell = floor(fragCoord / float2(fast::max((_68.uCheckerSize * 0.001000000047497451305389404296875) * _68.iResolution[1u], 2.0)));
    float3 board = mix(float3(1.0), float3(0.85000002384185791015625), float3(mod(cell.x + cell.y, 2.0)));
    float a = s.w + (_68.uBackdropAlpha * (1.0 - s.w));
    return float4((s.xyz + ((board * _68.uBackdropAlpha) * (1.0 - s.w))) / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _68)
{
    float4 _287;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _287 = overBackdrop(param, _68);
    }
    else
    {
        float2 param_1 = fract(uv);
        _287 = float4(testCard(param_1), 1.0);
    }
    return _287;
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _68)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _68);
    return pictureRGBA(tex, texSmplr, param_1, _68);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _68, texture2d<float> uTo, sampler uToSmplr, texture2d<float> uFrom, sampler uFromSmplr)
{
    float2 uv = fragCoord / float2(_68.iResolution[0], _68.iResolution[1]);
    float px = 1.0 / _68.iResolution[1u];
    float _430;
    if (_68.uAnimate != 0u)
    {
        _430 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_68.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _430 = _68.uProgress;
    }
    float p = _430;
    float2 dir = float2(cos(radians(_68.uAngle)), sin(radians(_68.uAngle)));
    float2 q = (fragCoord - (float2(_68.iResolution[0], _68.iResolution[1]) * 0.5)) * px;
    float2 halfSize = (float2(_68.iResolution[0], _68.iResolution[1]) * 0.5) * px;
    float ew = _68.uEdgeWidth * 0.001000000047497451305389404296875;
    float reach = (((abs(dir.x) * halfSize.x) + (abs(dir.y) * halfSize.y)) + ew) + (0.0500000007450580596923828125 * _68.uGlow);
    float s = dot(q, dir) - mix(-reach, reach, p);
    float cut = smoothstep(-px, px, s);
    float2 param = uv;
    float2 param_1 = fragCoord;
    float2 param_2 = uv;
    float4 col = mix(knockout(uTo, uToSmplr, param, param_1, _68), pictureCoverRGBA(uFrom, uFromSmplr, param_2, _68), float4(cut));
    float edge = (1.0 - smoothstep((0.5 * ew) - px, (0.5 * ew) + px, abs(s))) * step(9.9999997473787516355514526367188e-05, ew);
    float halo = ((exp((-abs(s)) / (0.0040000001899898052215576171875 + (2.0 * ew))) * _68.uGlow) * step(9.9999997473787516355514526367188e-05, ew)) * 0.60000002384185791015625;
    float light = fast::clamp(edge + halo, 0.0, 1.0);
    fragColor = float4(mix(col.xyz, float3(_68.uEdge), float3(light)), fast::max(col.w, light));
}

fragment flair_knockout_wipe_frag_out flair_knockout_wipe_frag(constant FlairUniforms& _68 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_knockout_wipe_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _601;
    if (_68.flair_flipY > 0.5)
    {
        _601 = _68.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _601 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _601);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _68, uTo, uToSmplr, uFrom, uFromSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

